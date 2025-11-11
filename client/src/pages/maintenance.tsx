import { Github, Wrench, Music } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Maintenance() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo/Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <Music className="w-24 h-24 text-blue-400 animate-pulse" />
            <Wrench className="w-12 h-12 text-yellow-400 absolute -bottom-2 -right-2 animate-bounce" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-white">
            CodedSwitch
          </h1>
          <p className="text-2xl md:text-3xl font-semibold text-blue-300">
            Under Construction
          </p>
        </div>

        {/* Message */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 space-y-4">
          <p className="text-xl text-gray-200">
            🚧 We're currently making some exciting improvements!
          </p>
          <p className="text-gray-300">
            The site is temporarily offline while we enhance your experience.
            Check back soon for something amazing.
          </p>
        </div>

        {/* GitHub Link */}
        <div className="space-y-4">
          <p className="text-gray-400">
            Want to follow our progress?
          </p>
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => window.open('https://github.com/asume21/Codedswitchmonatize', '_blank')}
          >
            <Github className="mr-2 h-5 w-5" />
            View Updates on GitHub
          </Button>
        </div>

        {/* Footer */}
        <div className="pt-8 text-gray-500 text-sm">
          <p>Expected to be back online soon</p>
          <p className="mt-2">Thank you for your patience! 🎵</p>
        </div>
      </div>
    </div>
  );
}
