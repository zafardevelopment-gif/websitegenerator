"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { BUSINESS_CATEGORIES } from "@aiwebsite/config";
import type { LeadRow } from "@aiwebsite/db/types";
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
  NativeSelect,
  Textarea,
} from "@aiwebsite/ui";

import { createLeadAction, updateLeadAction } from "@/lib/actions/leads";
import { EMPTY_LEAD_FORM, leadFormSchema, type LeadFormInput } from "@/lib/validation/leads";

function leadToForm(lead: LeadRow): LeadFormInput {
  return {
    ...EMPTY_LEAD_FORM,
    business_name: lead.business_name,
    category: (lead.category as LeadFormInput["category"]) ?? "",
    business_description: lead.business_description ?? "",
    owner_name: lead.owner_name ?? "",
    phone: lead.phone ?? "",
    whatsapp: lead.whatsapp ?? "",
    email: lead.email ?? "",
    website: lead.website ?? "",
    instagram: lead.instagram ?? "",
    facebook: lead.facebook ?? "",
    linkedin: lead.linkedin ?? "",
    google_rating: lead.google_rating?.toString() ?? "",
    review_count: lead.review_count?.toString() ?? "",
    address: lead.address ?? "",
    area: lead.area ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    country: lead.country,
    pincode: lead.pincode ?? "",
    google_maps_url: lead.google_maps_url ?? "",
    place_id: lead.place_id ?? "",
    services: Array.isArray(lead.services) ? (lead.services as string[]).join(", ") : "",
    lead_source: lead.lead_source ?? "",
    tags: lead.tags.join(", "),
    priority: lead.priority,
    next_follow_up: lead.next_follow_up ? lead.next_follow_up.slice(0, 10) : "",
    notes: lead.notes ?? "",
  };
}

export function LeadForm({ lead }: { lead?: LeadRow }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const form = useForm<LeadFormInput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: lead ? leadToForm(lead) : EMPTY_LEAD_FORM,
  });

  function onSubmit(values: LeadFormInput) {
    startTransition(async () => {
      const result = lead
        ? await updateLeadAction(lead.id, values)
        : await createLeadAction(values);
      if (result.ok) {
        toast.success(result.message);
        router.push(`/leads/${result.leadId ?? lead?.id ?? ""}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const text = (
    name: keyof LeadFormInput,
    label: string,
    props: React.ComponentProps<typeof Input> = {}
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...props} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <fieldset disabled={isPending} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {text("business_name", "Business name *", { placeholder: "Smile Dental Care" })}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <NativeSelect {...field}>
                        <option value="">Select category…</option>
                        {BUSINESS_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2">
                <FormField
                  control={form.control}
                  name="business_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="What the business does…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="services"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Services</FormLabel>
                    <FormControl>
                      <Input placeholder="Root Canal, Implants, Braces" {...field} />
                    </FormControl>
                    <FormDescription>Comma-separated list.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {text("owner_name", "Owner name", { placeholder: "Dr. Anjali Mehra" })}
              {text("phone", "Phone", { placeholder: "+91 98xxxxxxxx" })}
              {text("whatsapp", "WhatsApp", { placeholder: "Defaults to phone if empty" })}
              {text("email", "Email", { type: "email" })}
              {text("website", "Existing website", { placeholder: "https://…" })}
              {text("instagram", "Instagram", { placeholder: "@handle or URL" })}
              {text("facebook", "Facebook")}
              {text("linkedin", "LinkedIn")}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location & Google</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">{text("address", "Address")}</div>
              {text("area", "Area / locality", { placeholder: "Karol Bagh" })}
              {text("city", "City", { placeholder: "New Delhi" })}
              {text("state", "State")}
              {text("pincode", "PIN code", { placeholder: "110005" })}
              {text("google_rating", "Google rating", { placeholder: "4.7" })}
              {text("review_count", "Review count", { placeholder: "312" })}
              {text("google_maps_url", "Google Maps URL")}
              {text("place_id", "Place ID")}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>Source, priority, tags and follow-up.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {text("lead_source", "Lead source", { placeholder: "google_maps, referral…" })}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <NativeSelect {...field}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </NativeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="dentist, karol-bagh, no-website" {...field} />
                    </FormControl>
                    <FormDescription>Comma-separated; lowercased automatically.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {text("next_follow_up", "Next follow-up", { type: "date" })}
              <div className="sm:col-span-2">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </fieldset>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {lead ? "Save changes" : "Create lead"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
