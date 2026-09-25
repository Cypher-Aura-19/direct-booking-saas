import { AuthMessage, AuthShell, SCENES } from "@/components/auth/auth-shell";
import { IconMail } from "@/components/ui/icons";

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Check your email"
      scene={SCENES.blossom}
      aside={{ stamp: "Almost there", line: "One click in your inbox and your register is open." }}
      footer={
        <>
          Wrong address?{" "}
          <a href="/signup" className="font-medium text-accent underline-offset-4 hover:underline">
            Sign up again
          </a>
        </>
      }
    >
      <AuthMessage icon={<IconMail className="size-6" />} title="Confirmation link sent">
        We sent you a confirmation link. Click it to finish creating your account. It can take a minute to arrive,
        so check your spam folder too.
      </AuthMessage>
    </AuthShell>
  );
}
