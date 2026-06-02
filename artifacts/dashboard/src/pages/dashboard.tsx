import React, { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetBotStatus,
  getGetBotStatusQueryKey,
  useUpdateBotConfig,
  useStartAds,
  useStopAds,
  useSendAdNow
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Power,
  Play,
  Square,
  Send,
  Hash,
  Clock,
  AlignLeft,
  Server,
  TerminalSquare
} from "lucide-react";

const configSchema = z.object({
  channelId: z.string().min(1, "Channel ID is required"),
  message: z.string().min(1, "Message is required"),
  intervalMinutes: z.coerce.number().min(60, "Interval must be at least 60 minutes"),
});

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: status, isLoading, isError } = useGetBotStatus({
    query: {
      queryKey: getGetBotStatusQueryKey(),
      refetchInterval: 10000,
    }
  });

  const updateConfig = useUpdateBotConfig();
  const startAds = useStartAds();
  const stopAds = useStopAds();
  const sendAdNow = useSendAdNow();

  const form = useForm<z.infer<typeof configSchema>>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      channelId: "",
      message: "",
      intervalMinutes: 60,
    },
  });

  useEffect(() => {
    if (status) {
      form.reset({
        channelId: status.channelId || "",
        message: status.message || "",
        intervalMinutes: status.intervalMinutes || 60,
      });
    }
  }, [status, form]);

  const onSaveConfig = (values: z.infer<typeof configSchema>) => {
    updateConfig.mutate({ data: values }, {
      onSuccess: () => {
        toast({
          title: "Configuration Saved",
          description: "The bot configuration has been updated successfully.",
        });
        queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: "Failed to save configuration.",
          variant: "destructive",
        });
      }
    });
  };

  const onToggleAds = () => {
    if (!status) return;
    if (status.enabled) {
      stopAds.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
          toast({ title: "Ads Stopped", description: "Automated ads have been stopped." });
        }
      });
    } else {
      startAds.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
          toast({ title: "Ads Started", description: "Automated ads have been started." });
        }
      });
    }
  };

  const onSendNow = () => {
    sendAdNow.mutate(undefined, {
      onSuccess: (result) => {
        if (result.success) {
          toast({
            title: "Ad Sent",
            description: result.message,
          });
        } else {
          toast({
            title: "Failed to Send Ad",
            description: result.message,
            variant: "destructive",
          });
        }
      },
      onError: () => {
        toast({
          title: "Error",
          description: "An unexpected error occurred while sending the ad.",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/20 p-6 md:p-12 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 col-span-1" />
            <Skeleton className="h-32 col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Power className="h-5 w-5" />
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Failed to connect to the bot control panel. Ensure the bot is running and try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <TerminalSquare className="h-8 w-8 text-primary" />
              Ad Bot Control Panel
            </h1>
            <p className="text-muted-foreground mt-1">Manage scheduled promotional messages.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-md border shadow-sm" data-testid="status-bot-online">
              <div className={`h-3 w-3 rounded-full ${status.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-medium text-sm">
                {status.online ? "Bot Online" : "Bot Offline"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><Power className="h-5 w-5 text-muted-foreground" /> System Status</span>
                  {status.enabled ? (
                    <Badge className="bg-green-500 hover:bg-green-600">Running</Badge>
                  ) : (
                    <Badge variant="secondary">Stopped</Badge>
                  )}
                </CardTitle>
                <CardDescription>Main toggle for automated messaging</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  size="lg"
                  variant={status.enabled ? "destructive" : "default"} 
                  className="w-full font-bold text-base"
                  onClick={onToggleAds}
                  disabled={startAds.isPending || stopAds.isPending || !status.online}
                  data-testid="button-toggle-ads"
                >
                  {status.enabled ? (
                    <>
                      <Square className="mr-2 h-5 w-5" /> Stop Ads
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" /> Start Ads
                    </>
                  )}
                </Button>
                
                <Separator />
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Quick Actions</p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={onSendNow}
                    disabled={sendAdNow.isPending || !status.online}
                    data-testid="button-send-now"
                  >
                    <Send className="mr-2 h-4 w-4" /> Send Ad Immediately
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Current Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-muted-foreground"><Hash className="h-4 w-4" /> Channel</span>
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]" title={status.channelId || "Not set"}>{status.channelId || "Not set"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Interval</span>
                  <span className="font-medium">{status.intervalMinutes} mins</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  Configuration
                </CardTitle>
                <CardDescription>Update the message and targeting for the bot.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSaveConfig)} className="space-y-6" data-testid="form-config">
                    <FormField
                      control={form.control}
                      name="channelId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2"><Hash className="h-4 w-4" /> Target Channel ID</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 123456789012345678" {...field} className="font-mono" data-testid="input-channel" />
                          </FormControl>
                          <FormDescription>The Discord channel ID where messages will be sent.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="intervalMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2"><Clock className="h-4 w-4" /> Interval (minutes)</FormLabel>
                          <FormControl>
                            <Input type="number" min={60} {...field} data-testid="input-interval" />
                          </FormControl>
                          <FormDescription>How often to send the ad. Minimum is 60 minutes.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2"><AlignLeft className="h-4 w-4" /> Advertisement Message</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Enter the promotional message here..." 
                              className="min-h-[200px] resize-y font-mono text-sm"
                              {...field} 
                              data-testid="input-message"
                            />
                          </FormControl>
                          <FormDescription>The text that will be posted to the channel.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end pt-4">
                      <Button 
                        type="submit" 
                        disabled={updateConfig.isPending || !form.formState.isDirty}
                        data-testid="button-save"
                      >
                        Save Configuration
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
