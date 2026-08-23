import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { getAuthContext } from "@/lib/auth";
import { getPaymentRecommendation } from "@/lib/payment-recommendations";
import { prisma } from "@/lib/prisma";
import { RecommendationEditor } from "./recommendation-editor";
export default async function RecommendationPage({ params }: { params: Promise<{ id: string }> }) { const { sessionUser, appUser } = await getAuthContext(); if (!sessionUser) redirect("/login"); if (!appUser || appUser.role !== "GAA") return <main className="p-8">Access denied.</main>; const recommendation = await getPaymentRecommendation(prisma, appUser, (await params).id); if (!recommendation) return <main className="p-8">Recommendation not found.</main>; return <AppShell user={appUser}><RecommendationEditor initial={JSON.parse(JSON.stringify(recommendation))} /></AppShell>; }
