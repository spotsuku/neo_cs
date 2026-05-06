import { describe, it, expect } from "vitest";
import type { Company, Contact } from "@/lib/mock/entities";
import {
  extractDomain,
  isFreeEmailDomain,
  findCompanyByDomain,
  resolveSenderEmail
} from "./email-routing";

const companies: Company[] = [
  {
    id: "c-foo",
    name: "FooCorp",
    kana: "ふー",
    industry: "IT",
    address: "",
    ownerName: "古野",
    contracts: [],
    mrr: 0,
    lastTouchDays: 0,
    domains: ["foo.co.jp", "foo-inc.com"]
  },
  {
    id: "c-bar",
    name: "BarCorp",
    kana: "ばー",
    industry: "金融",
    address: "",
    ownerName: "三木",
    contracts: [],
    mrr: 0,
    lastTouchDays: 0,
    domains: ["bar.com"]
  }
];

const contacts: Contact[] = [
  {
    id: "p-1",
    companyId: "c-foo",
    name: "山田",
    department: "営業",
    title: "課長",
    email: "yamada@foo.co.jp",
    isPrimary: true,
    products: []
  }
];

describe("extractDomain", () => {
  it("抽出できる", () => {
    expect(extractDomain("a@example.com")).toBe("example.com");
    expect(extractDomain("a.b+tag@Sub.Example.CO.JP")).toBe("sub.example.co.jp");
  });
  it("不正値は null", () => {
    expect(extractDomain("noatsign")).toBeNull();
    expect(extractDomain("trailing@")).toBeNull();
    expect(extractDomain("")).toBeNull();
  });
});

describe("isFreeEmailDomain", () => {
  it("代表的フリーメールを判定", () => {
    expect(isFreeEmailDomain("gmail.com")).toBe(true);
    expect(isFreeEmailDomain("foo.co.jp")).toBe(false);
  });
});

describe("findCompanyByDomain", () => {
  it("複数ドメインのうちどれかにマッチすれば返す", () => {
    expect(findCompanyByDomain("foo-inc.com", companies)?.id).toBe("c-foo");
    expect(findCompanyByDomain("FOO.CO.JP", companies)?.id).toBe("c-foo");
  });
  it("マッチなしで null", () => {
    expect(findCompanyByDomain("unknown.com", companies)).toBeNull();
  });
  it("フリーメールはマッチさせない", () => {
    expect(findCompanyByDomain("gmail.com", companies)).toBeNull();
  });
});

describe("resolveSenderEmail", () => {
  it("contacts と完全一致 → known_contact", () => {
    const r = resolveSenderEmail("yamada@foo.co.jp", companies, contacts);
    expect(r.kind).toBe("known_contact");
    if (r.kind === "known_contact") {
      expect(r.contact.id).toBe("p-1");
      expect(r.company?.id).toBe("c-foo");
    }
  });
  it("ドメイン一致のみ → domain_match", () => {
    const r = resolveSenderEmail("newperson@foo-inc.com", companies, contacts);
    expect(r.kind).toBe("domain_match");
    if (r.kind === "domain_match") {
      expect(r.company.id).toBe("c-foo");
      expect(r.domain).toBe("foo-inc.com");
    }
  });
  it("未知ドメイン → unknown", () => {
    const r = resolveSenderEmail("a@nowhere.example", companies, contacts);
    expect(r.kind).toBe("unknown");
  });
  it("フリーメールは domain_match を返さない", () => {
    const r = resolveSenderEmail("personal@gmail.com", companies, contacts);
    expect(r.kind).toBe("unknown");
  });
});
