import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ExpiredLinkPage() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <h1 className="font-heading text-card-title font-medium">
          Ссылка устарела, запроси новую
        </h1>
      </CardHeader>
      <CardContent>
        <Link href="/login" className={buttonVariants()}>
          На страницу входа
        </Link>
      </CardContent>
    </Card>
  );
}
