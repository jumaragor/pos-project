import { describe, expect, test } from "vitest";
import { Role } from "@prisma/client";
import { can } from "@/lib/rbac";

describe("rbac", () => {
  test("cashier cannot void/refund", () => {
    expect(can(Role.CASHIER, "VOID_REFUND")).toBe(false);
  });

  test("manager can adjust inventory", () => {
    expect(can(Role.MANAGER, "INVENTORY_ADJUST")).toBe(true);
  });

  test("only owner can view profit", () => {
    expect(can(Role.OWNER, "VIEW_PROFIT")).toBe(true);
    expect(can(Role.MANAGER, "VIEW_PROFIT")).toBe(false);
  });
});
