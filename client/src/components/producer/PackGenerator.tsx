import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Sparkles, Dice1, Play, Pause, Download, Volume2, 
  Loader2, Zap, Package, Headphones, Music, Plus, DatabaseIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { audioManager } from "@/lib/audio";
import { realisticAudio } from "@/lib/realisticAudio";
import { apiRequest } from "@/lib/queryClient";

interface GeneratedPack {
  id: string;
  title: string;
  description: string;
  bpm: number;
  key: string;
  genre: string;
  samples: {
    id: string;
    name: string;
    type: "loop" | "oneshot" | "midi";
    duration: number;
    url?: string;
    audioUrl?: string; // For MusicGen real audio files
    pattern?: any;
