import React from "react";

export interface IITDHAppLoaderProps {
  title?: string;
  subtitle?: string;
  minHeight?: string | number;
  className?: string;
}

export const IITDHAppLoader: React.FC<IITDHAppLoaderProps> = ({
  title = "Signing you in...",
  subtitle = "Verifying your Google Workspace session and preparing your workspace...",
  minHeight = "100vh",
  className = "",
}) => {
  return (
    <div
      className={className}
      style={{
        minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at center, #ffffff 0%, #fbfdfc 45%, #f2f6f4 100%)",
        position: "relative",
        padding: "24px",
        boxSizing: "border-box",
        userSelect: "none",
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: "480px",
          width: "100%",
        }}
      >
        {/* Animated Circular Badge & Outer Progress Ring */}
        <div
          style={{
            position: "relative",
            width: "120px",
            height: "120px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "32px",
          }}
        >
          {/* Static Soft Track */}
          <svg
            width="116"
            height="116"
            viewBox="0 0 116 116"
            style={{ position: "absolute", transform: "rotate(-90deg)" }}
          >
            <circle
              cx="58"
              cy="58"
              r="54"
              fill="none"
              stroke="rgba(16, 185, 129, 0.15)"
              strokeWidth="3"
            />
          </svg>

          {/* Animated Spinner Ring */}
          <svg
            width="116"
            height="116"
            viewBox="0 0 116 116"
            style={{
              position: "absolute",
              animation: "iitdhSpin 1.4s linear infinite",
            }}
          >
            <circle
              cx="58"
              cy="58"
              r="54"
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeDasharray="180 340"
              strokeLinecap="round"
            />
          </svg>

          {/* Inner Glowing Green Circle */}
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "linear-gradient(145deg, #10b981 0%, #059669 100%)",
              boxShadow: "0 10px 25px -4px rgba(16, 185, 129, 0.45), 0 0 0 6px rgba(16, 185, 129, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
          >
            {/* Animated Equalizer Wave Bars */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                gap: "3.5px",
                height: "22px",
                paddingBottom: "1px",
              }}
            >
              <div
                style={{
                  width: "4px",
                  height: "8px",
                  backgroundColor: "#ffffff",
                  borderRadius: "2px",
                  animation: "iitdhBarWave 1.2s ease-in-out infinite",
                  animationDelay: "0s",
                }}
              />
              <div
                style={{
                  width: "4px",
                  height: "18px",
                  backgroundColor: "#ffffff",
                  borderRadius: "2px",
                  animation: "iitdhBarWave 1.2s ease-in-out infinite",
                  animationDelay: "0.2s",
                }}
              />
              <div
                style={{
                  width: "4px",
                  height: "12px",
                  backgroundColor: "#ffffff",
                  borderRadius: "2px",
                  animation: "iitdhBarWave 1.2s ease-in-out infinite",
                  animationDelay: "0.4s",
                }}
              />
            </div>
          </div>
        </div>

        {/* Heading */}
        <h3
          style={{
            fontWeight: 800,
            color: "#0f172a",
            fontSize: "24px",
            letterSpacing: "-0.03em",
            margin: "0 0 10px 0",
          }}
        >
          {title}
        </h3>

        {/* Subtitle */}
        <p
          style={{
            color: "#64748b",
            fontSize: "14.5px",
            lineHeight: 1.6,
            maxWidth: "360px",
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      </div>

      <style>
        {`
          @keyframes iitdhSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes iitdhBarWave {
            0%, 100% {
              transform: scaleY(0.4);
              opacity: 0.7;
            }
            50% {
              transform: scaleY(1);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
};

export default IITDHAppLoader;
