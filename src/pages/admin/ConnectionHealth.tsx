import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminAuth } from "@/components/AdminAuth";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
  ShieldCheck,
  Package,
  Tag,
  FileText,
  Warehouse,
  BookOpen,
  Bug,
} from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  name: string;
  status: "pass" | "fail";
  message: string;
  details?: any;
  duration_ms: number;
}

interface DebugAuth {
  token_prefix: string;
  token_length: number;
  token_hash: string;
  shop_domain: string;
  env_var_used: string;
  header_used: string;
}

interface HealthData {
  connected: boolean;
  store_domain: string;
  api_version: string;
  tested_at: string;
  granted_scopes: string[];
  tests: TestResult[];
  debug_auth?: DebugAuth;
}

const SCOPE_MAP: {
  scope: string;
  feature: string;
  description: string;
  required: boolean;
}[] = [
  { scope: "read_products", feature: "Products listing", description: "Fetch and display Shopify products", required: true },
  { scope: "write_products", feature: "Product creation (seller)", description: "Create products from seller portal", required: false },
  { scope: "read_orders", feature: "Orders dashboard read", description: "View orders in admin", required: true },
  { scope: "write_orders", feature: "Order status/tags update", description: "Update order status and attach tags", required: true },
  { scope: "read_draft_orders", feature: "Draft order read", description: "View draft orders", required: true },
  { scope: "write_draft_orders", feature: "Draft order creation", description: "Create draft orders at checkout", required: true },
  { scope: "read_price_rules", feature: "Discount read", description: "Fetch existing discount rules", required: true },
  { scope: "write_price_rules", feature: "Discount management", description: "Create/edit/delete discount codes", required: true },
  { scope: "read_discounts", feature: "Discounts (new API)", description: "Read discounts via new endpoint", required: false },
  { scope: "write_discounts", feature: "Discounts management (new)", description: "Manage discounts via new endpoint", required: false },
  { scope: "read_inventory", feature: "Inventory / Sold-out", description: "Check stock levels and hide sold-out", required: true },
  { scope: "write_inventory", feature: "Inventory updates", description: "Update stock levels from platform", required: false },
  { scope: "read_customers", feature: "One-time-per-customer checks", description: "Verify discount usage per customer", required: false },
  { scope: "read_metafields", feature: "Read metafields", description: "Read seller/pickup metadata on orders", required: true },
  { scope: "write_metafields", feature: "Write metafields", description: "Store seller ID and pickup time on orders", required: true },
];

const TEST_ICONS: Record<string, any> = {
  connection: Wifi,
  scopes: ShieldCheck,
  products: Package,
  discounts: Tag,
  draft_orders: FileText,
  inventory: Warehouse,
  metafields: BookOpen,
};

const TEST_LABELS: Record<string, string> = {
  connection: "Connection",
  scopes: "Scopes",
  products: "Products Read",
  discounts: "Discounts Read",
  draft_orders: "Draft Orders",
  inventory: "Inventory",
  metafields: "Metafields",
};

export default function ConnectionHealth() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningTest, setRunningTest] = useState<string | null>(null);

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Not authenticated");
      return null;
    }
    return session;
  };

  const runAllTests = async () => {
    setLoading(true);
    try {
      const session = await getSession();
      if (!session) return;

      const res = await supabase.functions.invoke("shopify-health-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw new Error(res.error.message);
      setHealthData(res.data as HealthData);
      toast.success("Diagnostics complete");
    } catch (err: any) {
      toast.error("Health check failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const runSingleTest = async (testName: string) => {
    setRunningTest(testName);
    try {
      const session = await getSession();
      if (!session) return;

      const res = await supabase.functions.invoke("shopify-health-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {},
      });

      if (res.error) throw new Error(res.error.message);

      const newData = res.data as HealthData;
      if (healthData) {
        const updatedTests = healthData.tests.map((t) => {
          const newTest = newData.tests.find((nt) => nt.name === t.name);
          return newTest || t;
        });
        setHealthData({ ...newData, tests: updatedTests });
      } else {
        setHealthData(newData);
      }
    } catch (err: any) {
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setRunningTest(null);
    }
  };

  const grantedScopes = healthData?.granted_scopes || [];
  const debugAuth = healthData?.debug_auth;

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8 space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BackButton to="/admin" />
              <div>
                <h1 className="font-display text-2xl">Connection Health</h1>
                <p className="text-sm text-muted-foreground">Shopify API diagnostics & scope verification</p>
              </div>
            </div>
            <Button onClick={runAllTests} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Run All Tests
            </Button>
          </div>

          {/* Connection Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {healthData?.connected ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                )}
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!healthData ? (
                <p className="text-sm text-muted-foreground">Run diagnostics to check connection status.</p>
              ) : (
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={healthData.connected ? "default" : "destructive"}>
                      {healthData.connected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Store</span>
                    <span className="font-mono text-xs">{healthData.store_domain}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Version</span>
                    <span>{healthData.api_version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Tested</span>
                    <span>{new Date(healthData.tested_at).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Debug Auth Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bug className="h-5 w-5 text-amber-500" />
                Debug Auth
              </CardTitle>
              <CardDescription>
                Token fingerprint & auth configuration. Run diagnostics to populate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!debugAuth ? (
                <p className="text-sm text-muted-foreground">Run diagnostics to see token debug info.</p>
              ) : (
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token Prefix</span>
                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{debugAuth.token_prefix}…</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token Length</span>
                    <span>{debugAuth.token_length} chars</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token Hash (SHA-256)</span>
                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{debugAuth.token_hash}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shop Domain</span>
                    <span className="font-mono text-xs">{debugAuth.shop_domain}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Env Var Used</span>
                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{debugAuth.env_var_used}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auth Header</span>
                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{debugAuth.header_used}</code>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scopes Checklist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Required vs Granted Scopes</CardTitle>
              <CardDescription>Based on features implemented in this platform</CardDescription>
            </CardHeader>
            <CardContent>
              {grantedScopes.length === 0 && !healthData ? (
                <p className="text-sm text-muted-foreground">Run diagnostics to fetch granted scopes.</p>
              ) : (
                <div className="space-y-2">
                  {SCOPE_MAP.map((item) => {
                    const isGranted = grantedScopes.includes(item.scope);
                    return (
                      <div key={item.scope} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{item.scope}</code>
                            {!item.required && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">optional</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                        <div className="ml-3">
                          {grantedScopes.length > 0 ? (
                            isGranted ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-200 text-xs">✅ Granted</Badge>
                            ) : item.required ? (
                              <Badge variant="destructive" className="text-xs">⚠️ Missing</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-blue-500 border-blue-200">ℹ️ Optional</Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-xs">Unknown</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Diagnostic Tests */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Diagnostic Tests</CardTitle>
              <CardDescription>Click individual tests or "Run All" to verify API access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(TEST_LABELS).map(([key, label]) => {
                  const Icon = TEST_ICONS[key] || Package;
                  const result = healthData?.tests.find((t) => t.name === key);
                  const isRunning = runningTest === key;

                  return (
                    <button
                      key={key}
                      onClick={() => runSingleTest(key)}
                      disabled={isRunning || loading}
                      className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
                    >
                      <div className="mt-0.5">
                        {isRunning ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : result ? (
                          result.status === "pass" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-destructive" />
                          )
                        ) : (
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        {result && (
                          <p className={`text-xs mt-0.5 ${result.status === "pass" ? "text-green-600" : "text-destructive"}`}>
                            {result.message}
                          </p>
                        )}
                        {result && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {result.duration_ms}ms
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Reconnect Shopify */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Reconnect Shopify</CardTitle>
              <CardDescription>
                If scopes are missing, update your Shopify app's permissions then update the stored token.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Go to your Shopify Partner dashboard → Apps → select your app</li>
                <li>Update the required scopes in "API access"</li>
                <li>Reinstall the app on your store to grant new scopes</li>
                <li>Copy the new Admin API access token</li>
                <li>Update the <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">SHOPIFY_ADMIN_TOKEN</code> secret in your project settings</li>
                <li>Re-run diagnostics above — verify <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">token_hash</code> changed</li>
                <li>"Connection" test must show PASS (200)</li>
              </ol>
            </CardContent>
          </Card>
        </main>
      </div>
    </AdminAuth>
  );
}
