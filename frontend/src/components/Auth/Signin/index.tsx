import Link from "next/link";
import SigninWithPassword from "../SigninWithPassword";

export default function Signin() {
  return (
    <>
        <SigninWithPassword />

      <div className="mt-6 text-center">
        <p className="text-dark-6">
          Don&apos;t have an account?{" "}
          <Link href="/auth/sign-up" className="font-medium text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </>
  );
}
