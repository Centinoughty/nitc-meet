import Link from "next/link";

export default function Home() {
  return (
    <>
      <main className="mx-[3%] h-screen flex items-center">
        <div className="w-full justify-around flex items-center gap-4">
          <div className="overflow-hidden rounded-3xl">
            <img
              src="/hero.avif"
              alt=""
              className="w-[800px] hover:scale-105 duration-700"
            />
          </div>
          <div className="my-8 flex flex-col items-center gap-4">
            <h1 className="text-4xl font-medium font-poppins mb-5">
              NITC Meet
            </h1>
            <p className="max-w-sm text-wrap text-center">
              A platform to connect with your fellow NITC students through live
              video and audio chats.
            </p>
            <Link href="/chat" className="px-5 py-3 bg-secondary rounded-full">
              Start a Chat
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
