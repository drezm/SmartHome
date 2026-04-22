import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";

export function LockedPreview({ title, description }: { title: string; description: string }) {
  const navigate = useNavigate();

  return (
    <Card className="rounded-3xl border-violet-400/20 bg-violet-500/10">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="shrink-0 rounded-2xl bg-violet-500/20 p-3">
            <Lock className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <p className="font-medium text-white">{title}</p>
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          </div>
        </div>
        <Button onClick={() => navigate("/checkout")} className="w-full sm:w-auto">
          Оформить подписку
        </Button>
      </CardContent>
    </Card>
  );
}
