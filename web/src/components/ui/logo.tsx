export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="InterviewForge logo"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="40%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* Left curly brace morphing into flame */}
      <path
        d="M20 54 C20 54, 14 48, 14 42 C14 38, 18 36, 18 32 C18 28, 12 26, 12 20 C12 14, 18 10, 22 8
           C20 14, 24 18, 24 22 C24 26, 20 28, 20 32 C20 36, 26 38, 26 42 C26 48, 20 54, 20 54Z"
        fill="url(#logo-grad)"
        opacity="0.9"
      />
      {/* Center flame */}
      <path
        d="M32 6 C32 6, 40 18, 38 28 C37 33, 34 34, 34 38 C34 42, 38 44, 36 50
           C34 46, 30 44, 30 40 C30 36, 34 33, 34 28 C34 20, 28 14, 32 6Z"
        fill="url(#logo-grad)"
        opacity="1"
      />
      {/* Right curly brace morphing into flame */}
      <path
        d="M44 54 C44 54, 50 48, 50 42 C50 38, 46 36, 46 32 C46 28, 52 26, 52 20 C52 14, 46 10, 42 8
           C44 14, 40 18, 40 22 C40 26, 44 28, 44 32 C44 36, 38 38, 38 42 C38 48, 44 54, 44 54Z"
        fill="url(#logo-grad)"
        opacity="0.9"
      />
    </svg>
  );
}
