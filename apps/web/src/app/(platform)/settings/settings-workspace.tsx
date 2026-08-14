"use client";

import { useState } from "react";
import { User, ScanFace, Building2, Lock, Layers } from "@bop/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bop/ui/components/card";
import { motion, AnimatePresence } from "motion/react";

import { CompanyForm } from "@/app/(platform)/settings/company-form";
import { PasswordForm } from "@/app/(platform)/settings/password-form";
import { ProfileForm } from "@/app/(platform)/settings/profile-form";
import { FaceEnrollmentCard } from "@/app/(platform)/settings/face-enrollment-card";
import { SettingsTopologyDiagram } from "@/app/(platform)/settings/settings-topology-diagram";
import type { CompanyBasics, CompanyProfile, MyProfile } from "@/lib/settings";

interface SettingsWorkspaceProps {
  profile: MyProfile;
  company: { basics: CompanyBasics; profile: CompanyProfile } | null;
}

export function SettingsWorkspace({ profile, company }: SettingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<
    "profile" | "face_id" | "company" | "security" | "topology"
  >("profile");

  const tabs = [
    {
      id: "profile",
      label: "My Profile",
      description: "Personal details & preferences",
      icon: User,
      badge: null,
    },
    {
      id: "face_id",
      label: "Biometric Face ID",
      description: "Touchless passwordless sign-in",
      icon: ScanFace,
      badge: "ENROLLED",
    },
    {
      id: "company",
      label: "Company & Tenant",
      description: "Entity details & registration",
      icon: Building2,
      badge: company?.basics?.name ?? "WWE OS",
    },
    {
      id: "security",
      label: "Security & Password",
      description: "Account authentication rules",
      icon: Lock,
      badge: null,
    },
    {
      id: "topology",
      label: "System Topology",
      description: "Architecture & live node telemetry",
      icon: Layers,
      badge: "TELEMETRY",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Settings Tab Selector Header Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-1.5 rounded-2xl bg-muted/40 border border-border/60 backdrop-blur-md">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex flex-col items-start p-3 rounded-xl transition-all duration-200 text-left relative overflow-hidden group ${
                isActive
                  ? "bg-background text-foreground shadow-md border border-border/80 ring-1 ring-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div
                  className={`p-1.5 rounded-lg ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-muted text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {tab.badge && (
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className="font-bold text-xs tracking-tight block truncate w-full">
                {tab.label}
              </span>
              <span className="text-[10px] text-muted-foreground truncate w-full block font-normal">
                {tab.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Workspace Content */}
      <AnimatePresence mode="wait">
        {activeTab === "profile" && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <Card>
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-emerald-400" />
                  Your Profile & Personal Preferences
                </CardTitle>
                <CardDescription>
                  Manage how your business identity appears across the platform and configure your
                  localized preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ProfileForm profile={profile} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === "face_id" && (
          <motion.div
            key="face_id"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <FaceEnrollmentCard />
          </motion.div>
        )}

        {activeTab === "company" && (
          <motion.div
            key="company"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {company ? (
              <Card>
                <CardHeader className="border-b border-border/40 pb-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-400" />
                    Company & Tenant Profile
                  </CardTitle>
                  <CardDescription>
                    Official organization details used across purchase orders, documents, invoices,
                    and reports.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <CompanyForm basics={company.basics} profile={company.profile} />
                </CardContent>
              </Card>
            ) : (
              <div className="p-8 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground">
                You do not have administrative permission to modify company profile details.
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "security" && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <Card>
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-400" />
                  Security & Authentication Rules
                </CardTitle>
                <CardDescription>
                  Update your account password and review device authentication enforcement
                  settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <PasswordForm />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === "topology" && (
          <motion.div
            key="topology"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <SettingsTopologyDiagram />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
