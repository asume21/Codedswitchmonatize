import { Button } from "@/components/ui/button";
import { SubscriptionButton } from "./SubscriptionButton";

export default function Header() {
  return (
    <div className="bg-studio-panel border-b border-gray-700 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          {/* CodedSwitch Animated Logo - Self-Drawing Effect */}
          <div className="w-10 h-10 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <defs>
                <style>
                  {`
                    .draw-line {
                      stroke-dasharray: 200;
                      stroke-dashoffset: 200;
                      animation: draw 3s ease-in-out forwards;
                    }
                    .draw-circle {
                      stroke-dasharray: 60;
                      stroke-dashoffset: 60;
                      animation: draw-circle 2s ease-in-out forwards;
                    }
                    .draw-eye {
                      stroke-dasharray: 100;
                      stroke-dashoffset: 100;
                      animation: draw-eye 2.5s ease-in-out forwards;
                    }
                    @keyframes draw {
                      to { stroke-dashoffset: 0; }
                    }
                    @keyframes draw-circle {
                      to { stroke-dashoffset: 0; }
                    }
                    @keyframes draw-eye {
                      to { stroke-dashoffset: 0; }
                    }
                    .fade-in {
                      opacity: 0;
                      animation: fadeIn 1s ease-in-out 2s forwards;
                    }
                    @keyframes fadeIn {
                      to { opacity: 1; }
                    }
                  `}
                </style>
              </defs>

              {/* Corner brackets - draw first */}
              <path
                d="M15 25 L15 15 L25 15"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                className="draw-line"
                style={{ animationDelay: "0s" }}
              />
              <path
                d="M75 15 L85 15 L85 25"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                className="draw-line"
                style={{ animationDelay: "0.2s" }}
              />
              <path
                d="M85 75 L85 85 L75 85"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                className="draw-line"
                style={{ animationDelay: "0.4s" }}
              />
              <path
                d="M25 85 L15 85 L15 75"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                className="draw-line"
                style={{ animationDelay: "0.6s" }}
              />

              {/* Connecting lines */}
              <line
                x1="25"
                y1="15"
                x2="40"
                y2="30"
                stroke="#60a5fa"
                strokeWidth="1.5"
                className="draw-line"
                style={{ animationDelay: "0.8s" }}
              />
              <line
                x1="75"
                y1="15"
                x2="60"
                y2="30"
                stroke="#60a5fa"
                strokeWidth="1.5"
                className="draw-line"
                style={{ animationDelay: "1s" }}
              />
              <line
                x1="85"
                y1="75"
                x2="70"
                y2="60"
                stroke="#60a5fa"
                strokeWidth="1.5"
                className="draw-line"
                style={{ animationDelay: "1.2s" }}
              />
              <line
                x1="15"
                y1="75"
                x2="30"
                y2="60"
                stroke="#60a5fa"
                strokeWidth="1.5"
                className="draw-line"
                style={{ animationDelay: "1.4s" }}
              />

              {/* Central eye shape - draws last */}
              <ellipse
                cx="50"
                cy="50"
                rx="20"
                ry="12"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                className="draw-eye"
                style={{ animationDelay: "1.6s" }}
              />
              <circle
                cx="50"
                cy="50"
                r="6"
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2"
                className="draw-circle"
                style={{ animationDelay: "2s" }}
              />
              <circle
                cx="50"
                cy="50"
                r="3"
                fill="#3b82f6"
                className="fade-in"
              />

              {/* Corner circular elements */}
              <circle
                cx="20"
                cy="20"
                r="8"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.5"
                className="draw-circle"
                style={{ animationDelay: "2.2s" }}
              />
              <circle
                cx="80"
                cy="20"
                r="8"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.5"
                className="draw-circle"
                style={{ animationDelay: "2.4s" }}
              />
              <circle
                cx="80"
                cy="80"
                r="8"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.5"
                className="draw-circle"
                style={{ animationDelay: "2.6s" }}
              />
              <circle
                cx="20"
                cy="80"
                r="8"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.5"
                className="draw-circle"
                style={{ animationDelay: "2.8s" }}
              />

              {/* Inner details for corner circles */}
              <circle
                cx="20"
                cy="20"
                r="3"
                fill="#60a5fa"
                className="fade-in"
                style={{ animationDelay: "2.2s" }}
              />
              <circle
                cx="80"
                cy="20"
                r="3"
                fill="#60a5fa"
                className="fade-in"
                style={{ animationDelay: "2.4s" }}
              />
              <circle
                cx="80"
                cy="80"
                r="3"
                fill="#60a5fa"
                className="fade-in"
                style={{ animationDelay: "2.6s" }}
              />
              <circle
                cx="20"
                cy="80"
                r="3"
                fill="#60a5fa"
                className="fade-in"
                style={{ animationDelay: "2.8s" }}
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-white">
              CodedSwitch
            </h1>
            <p className="text-xs text-blue-400 -mt-1 font-medium">
              AI Godfather
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <div className="w-2 h-2 bg-studio-success rounded-full animate-pulse"></div>
          <span>AI Engine Active</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <SubscriptionButton />
        <Button className="bg-studio-accent hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <i className="fas fa-save mr-2"></i>Save Project
        </Button>
        <Button
          variant="secondary"
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <i className="fas fa-share mr-2"></i>Export
        </Button>
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <span className="text-xs font-bold">CT</span>
        </div>
      </div>
    </div>
  );
}
