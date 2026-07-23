import Image from "next/image";

export function BrandHeader() {
  return (
    <header className="flex items-center gap-3 px-6 py-4 sm:px-10">
      <Image
        src="/poetic-fiddle-logo.svg"
        alt=""
        width={28}
        height={34}
        priority
      />
      <span className="font-serif text-xl font-semibold tracking-tight text-link">
        Poetic Fiddle
      </span>
    </header>
  );
}
