"use client";

import * as React from "react";
import { LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  initials,
} from "@aiwebsite/ui";

import { signOut } from "@/lib/actions/auth";

export interface UserMenuProps {
  name: string | null;
  email: string;
  role: string;
}

export function UserMenu({ name, email, role }: UserMenuProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const display = name?.trim() || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials(display)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{display}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
            </div>
            <Badge variant="secondary" className="shrink-0 capitalize">
              {role}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => startTransition(() => signOut())}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
