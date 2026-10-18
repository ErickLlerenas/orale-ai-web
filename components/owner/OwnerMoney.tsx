"use client";
import { createContext, useContext, type ReactNode } from "react";
import { pesos } from "@/lib/owner/format";
const Country = createContext<"MX" | "CL">("MX");
export function OwnerMoney({ country = "MX", children }: { country?: "MX" | "CL"; children: ReactNode }) {
  return <Country.Provider value={country}>{children}</Country.Provider>;
}
export function useOwnerMoney() {
  const country = useContext(Country);
  return { country, format: (cents: number) => pesos(cents, country) };
}
