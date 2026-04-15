import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductMetrics } from "@/hooks/useAnalyticsData";

interface Props {
  products: ProductMetrics[];
  onSelectProduct?: (productId: string) => void;
}

function ProductTable({
  items,
  columns,
  onSelect,
}: {
  items: ProductMetrics[];
  columns: { key: string; label: string; render: (m: ProductMetrics) => string | number }[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="overflow-auto max-h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">#</TableHead>
            <TableHead className="text-xs">Product</TableHead>
            {columns.map((c) => (
              <TableHead key={c.key} className="text-xs text-right">{c.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.slice(0, 15).map((m, i) => (
            <TableRow
              key={m.productId}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelect?.(m.productId)}
            >
              <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="text-xs font-medium max-w-[200px] truncate">
                {m.productName}
              </TableCell>
              {columns.map((c) => (
                <TableCell key={c.key} className="text-xs text-right">
                  {c.render(m)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + 2} className="text-center text-xs text-muted-foreground py-8">
                No data yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function AnalyticsLeaderboard({ products, onSelectProduct }: Props) {
  const mostViewed = [...products].sort((a, b) => b.views - a.views);
  const mostClicked = [...products].sort((a, b) => b.clicks - a.clicks);
  const mostCarted = [...products].sort((a, b) => b.addToCarts - a.addToCarts);
  const bestConverting = [...products]
    .filter((p) => p.views >= 3)
    .sort((a, b) => b.conversionRate - a.conversionRate);
  const highViewLowCart = [...products]
    .filter((p) => p.views >= 5 && p.cartRate < 10)
    .sort((a, b) => b.views - a.views);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Product Leaderboards</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="views">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="views" className="text-xs">Most Viewed</TabsTrigger>
            <TabsTrigger value="clicks" className="text-xs">Most Clicked</TabsTrigger>
            <TabsTrigger value="carts" className="text-xs">Most Carted</TabsTrigger>
            <TabsTrigger value="converting" className="text-xs">Best Converting</TabsTrigger>
            <TabsTrigger value="weak" className="text-xs">Needs Attention</TabsTrigger>
          </TabsList>

          <TabsContent value="views">
            <ProductTable
              items={mostViewed}
              onSelect={onSelectProduct}
              columns={[
                { key: "views", label: "Views", render: (m) => m.views },
                { key: "unique", label: "Unique", render: (m) => m.uniqueSessions.size },
                { key: "cartRate", label: "Cart %", render: (m) => `${m.cartRate.toFixed(1)}%` },
              ]}
            />
          </TabsContent>

          <TabsContent value="clicks">
            <ProductTable
              items={mostClicked}
              onSelect={onSelectProduct}
              columns={[
                { key: "clicks", label: "Clicks", render: (m) => m.clicks },
                { key: "views", label: "Views", render: (m) => m.views },
              ]}
            />
          </TabsContent>

          <TabsContent value="carts">
            <ProductTable
              items={mostCarted}
              onSelect={onSelectProduct}
              columns={[
                { key: "carts", label: "Add to Cart", render: (m) => m.addToCarts },
                { key: "cartRate", label: "Cart Rate", render: (m) => `${m.cartRate.toFixed(1)}%` },
                { key: "orders", label: "Orders", render: (m) => m.orders },
              ]}
            />
          </TabsContent>

          <TabsContent value="converting">
            <ProductTable
              items={bestConverting}
              onSelect={onSelectProduct}
              columns={[
                { key: "rate", label: "Conv. %", render: (m) => `${m.conversionRate.toFixed(1)}%` },
                { key: "views", label: "Views", render: (m) => m.views },
                { key: "orders", label: "Orders", render: (m) => m.orders },
              ]}
            />
          </TabsContent>

          <TabsContent value="weak">
            <ProductTable
              items={highViewLowCart}
              onSelect={onSelectProduct}
              columns={[
                { key: "views", label: "Views", render: (m) => m.views },
                { key: "carts", label: "Carts", render: (m) => m.addToCarts },
                { key: "cartRate", label: "Cart %", render: (m) => `${m.cartRate.toFixed(1)}%` },
              ]}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
