import Nav from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="no-print border-t border-stone-200 py-4 text-center text-xs text-stone-400">
        VetTracker assists observation — always consult a licensed veterinarian for medical decisions.
      </footer>
    </>
  );
}
