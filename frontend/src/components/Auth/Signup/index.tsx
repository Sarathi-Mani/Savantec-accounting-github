import Link from "next/link";
import SignupWithPassword from "../SignupWithPassword";

export default function Signup() {
  return (
    <>
      <SignupWithPassword />

      <div className="mt-6 text-center">
        <p className="text-dark-6">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="font-medium text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </>
  );
}
