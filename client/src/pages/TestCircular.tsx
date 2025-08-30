import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Play, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TestResult {
  testName: string;
  originalCode: string;
  regeneratedCode: string;
  similarityScore: number;
  structuralMatches: number;
  totalStructuralElements: number;
  passed: boolean;
  errors?: string[];
}

interface TestSuite {
  totalTests: number;
  passedTests: number;
  averageAccuracy: number;
  results: TestResult[];
  timestamp: string;
  success: boolean;
  message: string;
}

export default function TestCircular() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestSuite | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      const response = await apiRequest(
        "POST",
        "/api/test-circular-translation",
        {},
      );
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Test failed:", error);
      setResults({
        totalTests: 0,
        passedTests: 0,
        averageAccuracy: 0,
        results: [],
        timestamp: new Date().toISOString(),
        success: false,
        message: "Test execution failed",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            Circular Translation Testing
          </h1>
          <p className="text-gray-400 text-lg">
            Real accuracy testing for code → music → code conversion
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <Button
            onClick={runTests}
            disabled={isRunning}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-run-tests"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Run Circular Translation Tests
              </>
            )}
          </Button>
        </div>

        {results && (
          <div className="space-y-6">
            {/* Overall Results */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">
                  Test Results Summary
                </CardTitle>
                <CardDescription>
                  Completed at {new Date(results.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div
                      className="text-3xl font-bold text-blue-400"
                      data-testid="text-total-tests"
                    >
                      {results.totalTests}
                    </div>
                    <div className="text-gray-400">Total Tests</div>
                  </div>
                  <div className="text-center">
                    <div
                      className="text-3xl font-bold text-green-400"
                      data-testid="text-passed-tests"
                    >
                      {results.passedTests}
                    </div>
                    <div className="text-gray-400">Passed Tests</div>
                  </div>
                  <div className="text-center">
                    <div
                      className="text-3xl font-bold text-yellow-400"
                      data-testid="text-average-accuracy"
                    >
                      {results.averageAccuracy.toFixed(1)}%
                    </div>
                    <div className="text-gray-400">Average Accuracy</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Success Rate</span>
                    <span>
                      {(
                        (results.passedTests / results.totalTests) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <Progress
                    value={(results.passedTests / results.totalTests) * 100}
                    className="h-3"
                  />
                </div>

                {results.message && (
                  <div
                    className="mt-4 p-3 bg-gray-800 rounded text-sm"
                    data-testid="text-message"
                  >
                    {results.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Individual Test Results */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">
                Individual Test Results
              </h2>
              {results.results.map((test, index) => (
                <Card key={index} className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white flex items-center gap-2">
                        {test.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400" />
                        )}
                        {test.testName}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge
                          variant={test.passed ? "default" : "destructive"}
                        >
                          {test.passed ? "PASSED" : "FAILED"}
                        </Badge>
                        <Badge variant="outline">
                          {test.similarityScore.toFixed(1)}% accuracy
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-white font-medium mb-2">
                          Original Code
                        </h4>
                        <pre className="bg-gray-800 p-3 rounded text-sm overflow-x-auto">
                          <code>{test.originalCode}</code>
                        </pre>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-2">
                          Regenerated Code
                        </h4>
                        <pre className="bg-gray-800 p-3 rounded text-sm overflow-x-auto">
                          <code>{test.regeneratedCode}</code>
                        </pre>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">
                          Structural Matches:
                        </span>
                        <span className="ml-2 text-white">
                          {test.structuralMatches}/
                          {test.totalStructuralElements}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Similarity Score:</span>
                        <span className="ml-2 text-white">
                          {test.similarityScore.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {test.errors && test.errors.length > 0 && (
                      <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded">
                        <h5 className="text-red-400 font-medium mb-2">
                          Errors:
                        </h5>
                        <ul className="text-red-300 text-sm space-y-1">
                          {test.errors.map((error, i) => (
                            <li key={i}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
