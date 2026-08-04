"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from "@aiwebsite/ui";

import { saveAgencyProfileAction } from "@/lib/actions/settings";
import { agencyProfileSchema, type AgencyProfileInput } from "@/lib/validation/settings";

export function AgencyProfileForm({
  defaultValues,
  readOnly,
}: {
  defaultValues: AgencyProfileInput;
  readOnly: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const form = useForm<AgencyProfileInput>({
    resolver: zodResolver(agencyProfileSchema),
    defaultValues,
  });

  function onSubmit(values: AgencyProfileInput) {
    startTransition(async () => {
      const result = await saveAgencyProfileAction(values);
      if (result.ok) {
        toast.success(result.message);
        form.reset(values);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agency profile</CardTitle>
        <CardDescription>
          Used on demo banners, WhatsApp pitches, proposals and quotation PDFs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <fieldset disabled={readOnly || isPending} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency name</FormLabel>
                    <FormControl>
                      <Input placeholder="AIVEXA LLP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp number</FormLabel>
                      <FormControl>
                        <Input placeholder="+91 98xxxxxxx" {...field} />
                      </FormControl>
                      <FormDescription>Shown on every demo&apos;s banner.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="hello@aivexa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://…" {...field} />
                    </FormControl>
                    <FormDescription>
                      Direct upload arrives with the Media Library (Phase 8).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Registered office address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gst_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST number</FormLabel>
                    <FormControl>
                      <Input placeholder="07AAAAA0000A1Z5" className="uppercase" {...field} />
                    </FormControl>
                    <FormDescription>Optional — used on quotations.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
            {!readOnly && (
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : <Save />}
                Save profile
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
