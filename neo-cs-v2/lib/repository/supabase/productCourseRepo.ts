// product_courses (Supabase 実装)
//
// service_role 経由で書き込む。RLS は 0006_rls_policies.sql で
// authenticated 全件 read / admin write が定義済 (マスタ系)。
// 監査記録は runAfterWrite + auditHook 経由で audit_logs に流れる。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  ProductCourse,
  ProductCourseDeleteResult,
  ProductCourseRepo,
  ProductCourseUpsertInput
} from "../types";

type Row = {
  product_code: string;
  course_key: string;
  name: string;
  short_name: string | null;
  description: string | null;
  display_order: number;
};

function toCourse(r: Row): ProductCourse {
  return {
    productCode: r.product_code,
    courseKey: r.course_key,
    name: r.name,
    shortName: r.short_name ?? undefined,
    description: r.description ?? undefined,
    displayOrder: r.display_order
  };
}

export const supabaseProductCourseRepo: ProductCourseRepo = {
  async listByProduct(productCode) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("product_courses")
      .select("*")
      .eq("product_code", productCode)
      .order("display_order", { ascending: true });
    if (error) throw new Error(`product_courses.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toCourse(r));
  },

  async countContractsByCourse(productCode, courseKey) {
    const sb = getServiceClient();
    const { count, error } = await sb
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("product_code", productCode)
      .eq("course_key", courseKey);
    if (error) throw new Error(`contracts.count: ${error.message}`);
    return count ?? 0;
  },

  async upsert(input: ProductCourseUpsertInput) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const prevKey = input.previousCourseKey ?? input.courseKey;

    // 既存レコード取得
    const { data: beforeRow } = await sb
      .from("product_courses")
      .select("*")
      .eq("product_code", input.productCode)
      .eq("course_key", prevKey)
      .maybeSingle();

    const isRename = !!beforeRow && prevKey !== input.courseKey;
    const action: "create" | "update" = beforeRow ? "update" : "create";

    // 重複チェック (新規 / rename 後の course_key が既存と衝突しないか)
    if (!beforeRow || isRename) {
      const { data: dup } = await sb
        .from("product_courses")
        .select("course_key")
        .eq("product_code", input.productCode)
        .eq("course_key", input.courseKey)
        .maybeSingle();
      if (dup) {
        throw new Error(
          `course_key '${input.courseKey}' は既に ${input.productCode} 配下に存在します`
        );
      }
    }

    let displayOrder = input.displayOrder;
    if (displayOrder === undefined) {
      if (beforeRow) {
        displayOrder = (beforeRow as Row).display_order;
      } else {
        const { count } = await sb
          .from("product_courses")
          .select("course_key", { count: "exact", head: true })
          .eq("product_code", input.productCode);
        displayOrder = (count ?? 0) + 1;
      }
    }

    const newRow: Row = {
      product_code: input.productCode,
      course_key: input.courseKey,
      name: input.name,
      short_name: input.shortName ?? null,
      description: input.description ?? null,
      display_order: displayOrder
    };

    if (isRename) {
      // course_key は PK の一部のため、トランザクション的に
      // 1) contracts.course_key を新キーへ付け替え
      // 2) 旧 product_courses 行を削除
      // 3) 新 product_courses 行を insert
      // ※ FK は (product_code, course_key) → product_courses。
      //   先に新行を挿入 → contracts 移動 → 旧行 delete の順なら FK 違反を起こさない。
      const { error: insErr } = await sb.from("product_courses").insert(newRow);
      if (insErr) throw new Error(`product_courses.upsert(rename insert): ${insErr.message}`);

      const { error: ctErr } = await sb
        .from("contracts")
        .update({ course_key: input.courseKey })
        .eq("product_code", input.productCode)
        .eq("course_key", prevKey);
      if (ctErr) throw new Error(`contracts.update(rename): ${ctErr.message}`);

      const { error: delErr } = await sb
        .from("product_courses")
        .delete()
        .eq("product_code", input.productCode)
        .eq("course_key", prevKey);
      if (delErr) throw new Error(`product_courses.upsert(rename delete): ${delErr.message}`);
    } else if (beforeRow) {
      const { error } = await sb
        .from("product_courses")
        .update({
          name: newRow.name,
          short_name: newRow.short_name,
          description: newRow.description,
          display_order: newRow.display_order
        })
        .eq("product_code", input.productCode)
        .eq("course_key", input.courseKey);
      if (error) throw new Error(`product_courses.upsert(update): ${error.message}`);
    } else {
      const { error } = await sb.from("product_courses").insert(newRow);
      if (error) throw new Error(`product_courses.upsert(insert): ${error.message}`);
    }

    const after = toCourse(newRow);
    await runAfterWrite({
      entityType: "product_courses",
      entityId: `${input.productCode}:${input.courseKey}`,
      before: beforeRow ?? undefined,
      after,
      action,
      ctx
    });
    return after;
  },

  async delete(productCode, courseKey) {
    const sb = getServiceClient();
    const ctx = getActorContext();

    const { count, error: cErr } = await sb
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("product_code", productCode)
      .eq("course_key", courseKey);
    if (cErr) throw new Error(`contracts.count: ${cErr.message}`);

    if ((count ?? 0) > 0) {
      throw new Error(
        `このコースには ${count} 件の契約が紐付いているため削除できません`
      );
    }

    const { data: before } = await sb
      .from("product_courses")
      .select("*")
      .eq("product_code", productCode)
      .eq("course_key", courseKey)
      .maybeSingle();

    const { error } = await sb
      .from("product_courses")
      .delete()
      .eq("product_code", productCode)
      .eq("course_key", courseKey);
    if (error) throw new Error(`product_courses.delete: ${error.message}`);

    await runAfterWrite({
      entityType: "product_courses",
      entityId: `${productCode}:${courseKey}`,
      before,
      action: "delete",
      ctx
    });

    return { affectedContracts: count ?? 0 } satisfies ProductCourseDeleteResult;
  }
};
