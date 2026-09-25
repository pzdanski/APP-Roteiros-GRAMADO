import { UserReport } from '../../types';

export interface UserReportRepository {
  name: string;
  isRealDatabase: boolean;
  createReport(report: Omit<UserReport, 'id' | 'status' | 'created_at'>): Promise<UserReport>;
  getAllReports(): Promise<UserReport[]>;
  updateReportStatus(id: string, status: UserReport['status']): Promise<UserReport | null>;
}

export class InMemoryUserReportRepository implements UserReportRepository {
  name = 'InMemoryUserReportRepository';
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
    },
    {
      id: 'rep_002',
      place_id: 'pl_005',
      place_name: 'Parque Estadual do Caracol',
      report_type: 'horario_diferente',
      description: 'Fechamento dos portões ocorre às 17h para novos visitantes.',
      contact_email: '',
      status: 'pending',
      created_at: new Date(Date.now() - 86400000).toISOString()
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

export const userReportRepository: UserReportRepository = new InMemoryUserReportRepository();
