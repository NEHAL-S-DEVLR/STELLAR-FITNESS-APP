import { Suspense } from "react";
import TrainerProfile from "@/components/TrainerProfile";

export default function TrainerProfilePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-6 py-20" />}>
      <TrainerProfile />
    </Suspense>
  );
}
