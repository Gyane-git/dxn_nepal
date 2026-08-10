import Image from "next/image";

export function Logo({
  showText = false,
  iconSize = 52,
  className = "",
  textClassName = "",
}: {
  showText?: boolean;
  iconSize?: number;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 ${className}`}>
      <span className="relative shrink-0" style={{ width: iconSize, height: iconSize }}>
        <Image src="/dxn-logo.png" alt="DXN" fill sizes={`${iconSize}px`} className="object-contain" priority />
      </span>
      {showText && (
        <span className={`text-lg font-bold tracking-tight text-gray-900 ${textClassName}`}>
          <span className="text-primary-600">DXN</span>
        </span>
      )}
    </span>
  );
}
