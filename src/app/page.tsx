import type { Metadata } from "next";
import { HomeSearch } from "@/components/HomeSearch";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return <HomeSearch />;
}
