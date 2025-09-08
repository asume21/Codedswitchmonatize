import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MessageCircle, Heart, Reply, MoreVertical, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: Date;
  likes: number;
  isLiked: boolean;
  replies?: Comment[];
  parentId?: string;
}

interface CommentsSystemProps {
  projectId: string;
  projectTitle: string;
}

export default function CommentsSystem({ projectId, projectTitle }: CommentsSystemProps) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Fetch comments
  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['projectComments', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/projects/${projectId}/comments`);
      return await response.json();
    }
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (data: { content: string; parentId?: string }) => {
      const response = await apiRequest('POST', `/api/projects/${projectId}/comments`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comment Added",
        description: "Your comment has been posted"
      });
      setNewComment('');
      setReplyContent('');
      setReplyingTo(null);
      refetchComments();
    },
    onError: (error: any) => {
      toast({
        title: "Comment Failed",
        description: error.message || "Could not post comment",
        variant: "destructive"
      });
    }
  });

  // Like comment mutation
  const likeCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await apiRequest('POST', `/api/projects/${projectId}/comments/${commentId}/like`);
      return await response.json();
    },
    onSuccess: () => {
      refetchComments();
    }
  });

  const handleSubmitComment = () => {
    if (!newComment.trim()) {
      toast({
        title: "Comment Required",
        description: "Please write something before posting",
        variant: "destructive"
      });
      return;
    }
    addCommentMutation.mutate({ content: newComment });
  };

  const handleSubmitReply = (parentId: string) => {
    if (!replyContent.trim()) {
      toast({
        title: "Reply Required",
        description: "Please write something before posting",
        variant: "destructive"
      });
      return;
    }
    addCommentMutation.mutate({ content: replyContent, parentId });
  };

  const handleLikeComment = (commentId: string) => {
    likeCommentMutation.mutate(commentId);
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`${isReply ? 'ml-8 mt-3' : 'mb-6'} ${isReply ? 'border-l-2 border-gray-600 pl-4' : ''}`}>
      <div className="flex gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
          <AvatarFallback>{comment.author.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.author.name}</span>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {isReply && (
              <Badge variant="outline" className="text-xs">
                Reply
              </Badge>
            )}
          </div>

          <p className="text-gray-300 mb-3">{comment.content}</p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => handleLikeComment(comment.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                comment.isLiked
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Heart className={`w-3 h-3 ${comment.isLiked ? 'fill-current' : ''}`} />
              {comment.likes}
            </button>

            {!isReply && (
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                <Reply className="w-3 h-3" />
                Reply
              </button>
            )}

            <button className="text-xs text-gray-400 hover:text-gray-300 transition-colors">
              <MoreVertical className="w-3 h-3" />
            </button>
          </div>

          {/* Reply Form */}
          {replyingTo === comment.id && (
            <div className="mt-3 space-y-3">
              <Textarea
                placeholder={`Reply to ${comment.author.name}...`}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="bg-gray-700 border-gray-600 text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={addCommentMutation.isPending}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  {addCommentMutation.isPending ? 'Posting...' : 'Reply'}
                </Button>
                <Button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-gray-700 hover:bg-gray-600"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Nested Replies */}
          {comment.replies && comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} isReply={true} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Card className="w-full bg-gray-800 border-gray-600">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-blue-400" />
          Comments & Feedback
        </CardTitle>
        <p className="text-sm text-gray-400">
          Discuss and get feedback on "{projectTitle}"
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add Comment Form */}
        <Card className="bg-gray-700 border-gray-600">
          <CardContent className="p-4">
            <Textarea
              placeholder="Share your thoughts about this project..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="bg-gray-600 border-gray-500 mb-3"
              rows={3}
            />
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-400">
                Be constructive and respectful in your feedback
              </div>
              <Button
                onClick={handleSubmitComment}
                disabled={addCommentMutation.isPending || !newComment.trim()}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Comments List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Comments ({comments?.length || 0})
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-gray-700 hover:bg-gray-600">
                Most Liked
              </Button>
              <Button variant="outline" size="sm" className="bg-gray-700 hover:bg-gray-600">
                Newest
              </Button>
            </div>
          </div>

          {comments && comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment: Comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No comments yet</h3>
              <p className="text-gray-400 mb-4">
                Be the first to share your thoughts about this project
              </p>
              <Badge variant="outline" className="bg-blue-600">
                💡 Tip: Comments help artists improve and collaborate
              </Badge>
            </div>
          )}
        </div>

        {/* Comment Guidelines */}
        <Card className="bg-blue-900/20 border-blue-600/30">
          <CardContent className="p-4">
            <h4 className="font-semibold text-blue-400 mb-2">💬 Comment Guidelines</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Be constructive and specific in your feedback</li>
              <li>• Focus on the music, not personal attacks</li>
              <li>• Ask questions to understand the artist's vision</li>
              <li>• Share what works well and areas for improvement</li>
              <li>• Respect different musical styles and preferences</li>
            </ul>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
