"use client";

import { useRouter } from "next/navigation";
import LandingPage from "./components/LandingPage";
import Header from "./components/Header";

export default function Home() {
  const router = useRouter();
  const launch = () => router.push("/app");
  return (
    <div className="landing-privy">
      <Header onLaunch={launch} />
      <LandingPage onLaunch={launch} />
    </div>
  );
}
