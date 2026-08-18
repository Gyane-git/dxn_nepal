import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/layout/Logo";
import { DistributorApplicationForm } from "@/components/distributor/DistributorApplicationForm";

export default async function DistributorPortalPage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login?callbackUrl=/distributor");
  if (sessionUser.role === "DISTRIBUTOR") redirect("/account");
  if (sessionUser.role === "ADMIN") redirect("/admin");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, phone: true },
  });
  if (!user) redirect("/login");

  const application = await prisma.distributorApplication.findFirst({
    where: { userId: sessionUser.id },
    orderBy: { createdAt: "desc" },
    select: { status: true, rejectionReason: true, createdAt: true },
  });

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-12">
      <Logo showText={false} iconSize={48} className="mx-auto" />
      <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-gray-900">Distributor Onboarding Portal</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Apply to become a DXN Distributor and unlock distributor pricing and PV rewards.
      </p>

      <div className="mt-8">
        <DistributorApplicationForm
          defaultName={user.name}
          defaultPhone={user.phone ?? ""}
          application={
            application
              ? { status: application.status, rejectionReason: application.rejectionReason, createdAt: application.createdAt.toISOString() }
              : null
          }
        />
      </div>
    </div>
  );
}
