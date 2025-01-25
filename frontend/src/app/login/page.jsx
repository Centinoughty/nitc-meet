import Link from "next/link";
import { FaGoogle } from "react-icons/fa";

export default function Home() {
  return (
    <>
      <main className="h-screen flex justify-center items-center">
        <div className="text-lg w-96 flex flex-col items-center gap-4 p-6 py-20 rounded-md shadow-lg font-poppins">
          <p className="text-lg">
            Welcome to <span className="font-semibold">NITC Meet</span>
          </p>
          <Link
            href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/google/callback`}
            className="flex items-center gap-2 w-full justify-center bg-secondary/70 hover:bg-secondary duration-300 rounded-full p-2 font-bold text-white"
          >
            <FaGoogle />
            <span>Sign in with NITC Mail</span>
          </Link>
        </div>
      </main>
    </>
  );
}
