import React from 'react';
import { ExamData } from '../types';
import { Download, Table as TableIcon } from 'lucide-react';

interface DataTableProps {
  data: ExamData[];
}

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
  if (data.length === 0) return null;

  const handleExportCSV = () => {
    // Requested columns: 교과목, 평균, 90~100, 80~89, 70~79, 60~69, 0~59
    const headers = [
      '교과목', '평균', '응시자', 
      '90~100', '80~89', '70~79', '60~69', '0~59'
    ];

    const rows = data.map(item => [
      item.subject,
      item.average,
      item.totalStudents,
      item.gradeCounts.score_90_100,
      item.gradeCounts.score_80_89,
      item.gradeCounts.score_70_79,
      item.gradeCounts.score_60_69,
      item.gradeCounts.score_under_60
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'exam_analysis_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-800">분석 결과 데이터</h2>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV 다운로드
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-700 uppercase bg-slate-100">
            <tr>
              <th className="px-4 py-3 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 w-1/4">교과목</th>
              <th className="px-4 py-3 text-center border-r border-slate-200">평균</th>
              <th className="px-4 py-3 text-center border-r border-slate-200">응시자</th>
              <th className="px-4 py-3 text-center bg-green-50">90~100</th>
              <th className="px-4 py-3 text-center bg-green-50">80~89</th>
              <th className="px-4 py-3 text-center">70~79</th>
              <th className="px-4 py-3 text-center">60~69</th>
              <th className="px-4 py-3 text-center bg-red-50">0~59</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
                return (
                    <tr key={index} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                            {row.subject}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700 border-r border-slate-200">
                            {row.average}
                        </td>
                        <td className="px-4 py-3 text-center border-r border-slate-200">
                            {row.totalStudents}
                        </td>
                        
                        {/* High Scores */}
                        <td className="px-4 py-3 text-center bg-green-50/50 font-medium text-green-700">{row.gradeCounts.score_90_100}</td>
                        <td className="px-4 py-3 text-center bg-green-50/50 text-green-600">{row.gradeCounts.score_80_89}</td>
                        
                        {/* Mid Scores */}
                        <td className="px-4 py-3 text-center">{row.gradeCounts.score_70_79}</td>
                        <td className="px-4 py-3 text-center">{row.gradeCounts.score_60_69}</td>
                        
                        {/* Low Scores (0-59) */}
                        <td className="px-4 py-3 text-center bg-red-50/50 text-red-600 font-medium">
                            {row.gradeCounts.score_under_60}
                        </td>
                    </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};