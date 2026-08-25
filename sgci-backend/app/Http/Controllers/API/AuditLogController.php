<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    protected $auditLogService;

    public function __construct(AuditLogService $auditLogService)
    {
        $this->auditLogService = $auditLogService;
    }

    public function index(Request $request): JsonResponse
    {
        $query = \App\Models\AuditLog::with('user');

        // Filtre par boutique courante (multi-tenancy)
        if ($request->user()->current_boutique_id) {
            $query->where('boutique_id', $request->user()->current_boutique_id);
        }

        // Filtrer par utilisateur
        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        // Filtrer par action
        if ($request->has('action')) {
            $query->where('action', $request->action);
        }

        // Filtrer par modèle
        if ($request->has('model')) {
            $query->where('model', $request->model);
        }

        // Filtrer par date
        if ($request->has('from_date')) {
            $query->where('created_at', '>=', $request->from_date);
        }

        if ($request->has('to_date')) {
            $query->where('created_at', '<=', $request->to_date);
        }

        // Pagination
        $perPage = $request->input('per_page', 50);
        $logs = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json($logs);
    }

    public function show($id): JsonResponse
    {
        $log = \App\Models\AuditLog::with('user')->findOrFail($id);

        return response()->json($log);
    }

    public function stats(Request $request): JsonResponse
    {
        $query = \App\Models\AuditLog::query();

        // Filtre par boutique courante (multi-tenancy)
        if ($request->user()->current_boutique_id) {
            $query->where('boutique_id', $request->user()->current_boutique_id);
        }

        $stats = [
            'total_logs' => (clone $query)->count(),
            'logs_today' => (clone $query)->whereDate('created_at', today())->count(),
            'logs_this_week' => (clone $query)->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])->count(),
            'logs_this_month' => (clone $query)->whereMonth('created_at', now()->month)->count(),
            'top_actions' => (clone $query)->select('action')
                ->selectRaw('action, COUNT(*) as count')
                ->groupBy('action')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
            'top_users' => \App\Models\AuditLog::with('user')
                ->select('user_id')
                ->selectRaw('user_id, COUNT(*) as count')
                ->with('user')
                ->groupBy('user_id')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
        ];

        return response()->json($stats);
    }

    public function export(Request $request): JsonResponse
    {
        $query = \App\Models\AuditLog::with('user');

        // Appliquer les mêmes filtres que index
        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->has('action')) {
            $query->where('action', $request->action);
        }

        if ($request->has('model')) {
            $query->where('model', $request->model);
        }

        if ($request->has('from_date')) {
            $query->where('created_at', '>=', $request->from_date);
        }

        if ($request->has('to_date')) {
            $query->where('created_at', '<=', $request->to_date);
        }

        $logs = $query->orderByDesc('created_at')->get();

        return response()->json([
            'data' => $logs,
            'filename' => 'audit-logs-' . now()->format('Y-m-d') . '.json',
        ]);
    }
}
