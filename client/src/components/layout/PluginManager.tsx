import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Music, Wrench, BarChart3, Settings } from 'lucide-react';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  category: 'studio' | 'production' | 'analysis' | 'utility';
  component: React.ComponentType;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}

interface PluginManagerProps {
  plugins: Plugin[];
  onTogglePlugin: (pluginId: string) => void;
}

const categoryIcons = {
  studio: Music,
  production: Wrench,
  analysis: BarChart3,
  utility: Settings,
};

const categoryColors = {
  studio: 'bg-blue-500',
  production: 'bg-green-500',
  analysis: 'bg-purple-500',
  utility: 'bg-orange-500',
};

export function PluginManager({ plugins, onTogglePlugin }: PluginManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', 'studio', 'production', 'analysis', 'utility'];
  const activePlugins = plugins.filter(p => p.active);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plugin Manager</h1>
          <p className="text-muted-foreground">
            Manage your music production tools and utilities
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {activePlugins.length} Active
        </Badge>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search plugins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {categories.map((category) => {
            const Icon = category === 'all' ? Settings : categoryIcons[category as keyof typeof categoryIcons];
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                <Icon className="w-4 h-4 mr-2" />
                {category}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Active Plugins Summary */}
      {activePlugins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Plugins</CardTitle>
            <CardDescription>Currently running tools</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activePlugins.map((plugin) => {
                const Icon = plugin.icon;
                return (
                  <Badge
                    key={plugin.id}
                    variant="default"
                    className={`${categoryColors[plugin.category]} text-white`}
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {plugin.name}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plugin Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlugins.map((plugin) => {
          const Icon = plugin.icon;
          const CategoryIcon = categoryIcons[plugin.category];
          
          return (
            <Card key={plugin.id} className={`transition-all hover:shadow-lg ${plugin.active ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <CardTitle className="text-lg">{plugin.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      <CategoryIcon className="w-3 h-3 mr-1" />
                      {plugin.category}
                    </Badge>
                  </div>
                </div>
                <CardDescription>{plugin.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  onClick={() => onTogglePlugin(plugin.id)}
                  variant={plugin.active ? 'destructive' : 'default'}
                  className="w-full"
                >
                  {plugin.active ? 'Deactivate' : 'Activate'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredPlugins.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No plugins found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search terms or category filter
          </p>
        </div>
      )}
    </div>
  );
}
