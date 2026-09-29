import { UserReport } from '../../types';

export interface UserReportRepository {
  name: string;
  isRealDatabase: boolean;
  createReport(report: Omit<UserReport, 'id' | 'status' | 'created_at'>): Promise<UserReport>;
  getAllReports(): Promise<UserReport[]>;
  updateReportStatus(id: string, status: UserReport['status']): Promise<UserReport | null>;
}

export class InMemoryUserReportRepository implements UserReportRepository {
  name = 'InMemoryUserReportRepository (Mock)';
  isRealDatabase = false;
  private reports: UserReport[] = [
    {
      id: 'rep_001',
      place_id: 'pl_001',
      place_name: 'Parque Snowland',
      report_type: 'preco_diferente',
      description: 'Preço na bilheteria em alta temporada aumentou R$ 10,00.',
      contact_email: 'turista@exemplo.com',
      status: 'pending',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    }
  ];

  async createReport(data: Omit<UserReport, 'id' | 'status' | 'created_at'>): Promise<UserReport> {
    const newReport: UserReport = {
      id: `rep_${Date.now()}`,
      ...data,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    this.reports.unshift(newReport);
    return newReport;
  }

  async getAllReports(): Promise<UserReport[]> {
    return this.reports;
  }

  async updateReportStatus(id: string, status: UserReport['status']): Promise<UserReport | null> {
    const report = this.reports.find(r => r.id === id);
    if (!report) return null;
    report.status = status;
    return report;
  }
}

export class SupabaseUserReportRepository implements UserReportRepository {
  name = 'SupabaseUserReportRepository';
  isRealDatabase = true;

  async createReport(data: Omit<UserReport, 'id' | 'status' | 'created_at'>): Promise<UserReport> {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      throw new Error('DATABASE_UNAVAILABLE: Failed to create user report in Supabase');
    }
    const json = await res.json();
    return json.report || json;
  }

  async getAllReports(): Promise<UserReport[]> {
    const res = await fetch('/api/reports');
    if (!res.ok) {
      throw new Error('DATABASE_UNAVAILABLE: Failed to get user reports from Supabase');
    }
    return await res.json();
  }

  async updateReportStatus(id: string, status: UserReport['status']): Promise<UserReport | null> {
    const res = await fetch(`/api/reports/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to update report ${id}`);
    }
    return await res.json();
  }
}
