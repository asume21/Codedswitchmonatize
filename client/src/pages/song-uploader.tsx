import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SongUploaderPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <Card className="max-w-3xl mx-auto bg-slate-800">
        <CardHeader>
          <CardTitle>Upload a Song</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 uploader">
          <p className="text-sm text-slate-300">
            Choose an audio file to upload or drag and drop below.
          </p>
          <Input type="file" className="bg-slate-900 text-white" />
          <div className="dropzone border border-dashed border-slate-600 rounded p-6 text-center">
            drag & drop your file here or click browse
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
