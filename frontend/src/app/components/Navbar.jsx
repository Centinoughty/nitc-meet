"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [userdata, setUserdata] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/login/success`,
          { withCredentials: true }
        );

        setUserdata(response.data.user);
      } catch (error) {
        console.log(error);
      }
    };

    getUser();
  }, []);

  return (
    <>
      <nav className="p-4 bg-primary fixed w-screen">
        <div className="relative flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/centinoughty.png" alt="" className="h-10 rounded-full" />
            <span>NITC Meet</span>
          </Link>
          <div className="flex items-center gap-2">
            {userdata ? ( // Check if userdata is not null
              <>
                <div>{userdata?.displayName}</div>
                <Link
                  href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout`}
                  className=""
                >
                  Log Out
                </Link>

                <div>
                  <img
                    className="w-10 rounded-full"
                    src={userdata?.image}
                    alt=""
                  />
                </div>
              </>
            ) : (
              <Link href="/login" className="">
                Log In
              </Link>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
