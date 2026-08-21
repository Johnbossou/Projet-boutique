'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Activity,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  model: string | null;
  model_id: number | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

interface AuditStats {
  total_logs: number;
  logs_today: number;
  logs_this_week: number;
  logs_this_month: number;
  top_actions: Array<{ action: string; count: number }>;
  top_users: Array<{ user_id: number; count: number; user?: { name: string; email: string } }>;
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  
  useEffect(() => {
    if (user?.role !== 'gerant') {
      toast.error('Accès refusé');
      window.location.href = '/dashboard';
      return;
    }
    
    chargerLogs();
    chargerStats();
  }, [user]);
  
  const chargerLogs = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/audit-logs');
      if (!response.ok) throw new Error('Erreur lors du chargement des logs');
      
      const data = await response.json();
      setLogs(data.data || data);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des logs');
    } finally {
      setIsLoading(false);
    }
  };
  
  const chargerStats = async () => {
    try {
      const response = await apiFetch('/audit-logs/stats');
      if (!response.ok) throw new Error('Erreur lors du chargement des stats');
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };
  
  const exporterLogs = async () => {
    try {
      const response = await apiFetch('/audit-logs/export');
      if (!response.ok) throw new Error('Erreur lors de l\'export');
      
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = data.filename || 'audit-logs.json';
      a.click();
      
      toast.success('Export réussi');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'export');
    }
  };
  
  const filteredLogs = logs.filter(log => {
    const matchSearch = !searchTerm || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.model && log.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.user?.name && log.user.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchAction = actionFilter === 'all' || log.action === actionFilter;
    const matchModel = modelFilter === 'all' || log.model === modelFilter;
    
    return matchSearch && matchAction && matchModel;
  });
  
  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: 'bg-green-500/10 text-green-600 border-green-500/20',
      update: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      delete: 'bg-red-500/10 text-red-600 border-red-500/20',
      login: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      logout: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      failed_login: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      unauthorized_access: 'bg-red-500/10 text-red-600 border-red-500/20',
    };
    
    return colors[action] || 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8 text-muted-foreground">
          Chargement des logs d'audit...
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Logs d'Audit
          </h1>
          <p className="text-muted-foreground mt-1">
            Traçabilité complète des actions du système
          </p>
        </div>
        <Button onClick={exporterLogs} className="gap-2">
          <Download className="w-4 h-4" />
          Exporter
        </Button>
      </div>
      
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_logs}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aujourd'hui</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.logs_today}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cette Semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.logs_this_week}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ce Mois</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.logs_this_month}</div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Filtres */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                <SelectItem value="create">Création</SelectItem>
                <SelectItem value="update">Modification</SelectItem>
                <SelectItem value="delete">Suppression</SelectItem>
                <SelectItem value="login">Connexion</SelectItem>
                <SelectItem value="logout">Déconnexion</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Modèle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les modèles</SelectItem>
                <SelectItem value="User">Utilisateurs</SelectItem>
                <SelectItem value="Produit">Produits</SelectItem>
                <SelectItem value="Vente">Ventes</SelectItem>
                <SelectItem value="Client">Clients</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Tableau des logs */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Actions</CardTitle>
          <CardDescription>
            Liste complète des actions enregistrées dans le système
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Modèle</TableHead>
                <TableHead>Détails</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucun log trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      {log.user ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{log.user.name}</div>
                            <div className="text-xs text-muted-foreground">{log.user.email}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Système</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getActionBadge(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.model || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Afficher les détails dans un modal (à implémenter)
                          console.log('Détails:', log);
                        }}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ip_address || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
