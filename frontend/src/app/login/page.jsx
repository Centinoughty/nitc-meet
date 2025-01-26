"use client";

import { signIn, useSession } from "next-auth/react";
import { FaGoogle } from "react-icons/fa";

export default function LoginPage() {
  const { data: session } = useSession();

  return (
    <main className="h-screen flex justify-center items-center bg-gray-100">
      <div className="text-lg w-96 flex flex-col items-center gap-4 p-6 py-20 rounded-md shadow-lg font-poppins bg-white">
        <p className="text-lg">
          Welcome to <span className="font-semibold">NITC Meet</span>
        </p>
        {!session ? (
          <button
            onClick={() => signIn("google")}
            className="flex items-center gap-2 w-full justify-center bg-secondary/70 hover:bg-secondary duration-300 rounded-full p-2 font-bold text-white"
          >
            <FaGoogle />
            <span>Sign in with NITC Mail</span>
          </button>
        ) : (
          <div className="text-center">
            <p className="text-lg">
              Welcome back,{" "}
              <span className="font-semibold">{session.user.name}</span>!
            </p>
            <p className="text-sm text-gray-500">{session.user.email}</p>
            <a
              href="/dashboard"
              className="mt-4 block bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg"
            >
              Go to Dashboard
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
