import React, { useState, useRef } from 'react';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { convertPdfToImages } from './utils/pdfUtils';
import { extractDataFromImages } from './services/gemini';
import { DataTable } from './components/DataTable';
import { ExamData, ProcessingStatus } from './types';

const App: React.FC = () => {
  const [examData, setExamData] = useState<ExamData[]>([]);
  const [processingQueue, setProcessingQueue] = useState<ProcessingStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const newFiles: File[] = Array.from(event.target.files);
      
      const newQueueItems: ProcessingStatus[] = newFiles.map(file => ({
        fileName: file.name,
        status: 'pending'
      }));

      setProcessingQueue(prev => [...prev, ...newQueueItems]);
      processFiles(newFiles);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = async (files: File[]) => {
    if (isProcessing) return; // Simple queue lock, in real app use a proper queue effect
    setIsProcessing(true);

    for (const file of files) {
      // Update status to processing
      setProcessingQueue(prev => prev.map(item => 
        item.fileName === file.name ? { ...item, status: 'processing' } : item
      ));

      try {
        // 1. Convert PDF to Images
        const images = await convertPdfToImages(file);
        
        // 2. Send to Gemini
        const extractedResults = await extractDataFromImages(images);

        // 3. Update Data
        setExamData(prev => {
          // Avoid duplicates if re-uploading same subject, strictly speaking tricky without ID
          // Just appending for now, could filter by subject name later
          return [...prev, ...extractedResults];
        });

        // Update status to success
        setProcessingQueue(prev => prev.map(item => 
          item.fileName === file.name ? { ...item, status: 'completed' } : item
        ));

      } catch (error: any) {
        console.error(`Error processing ${file.name}:`, error);
        setProcessingQueue(prev => prev.map(item => 
          item.fileName === file.name ? { ...item, status: 'error', message: error.message || 'Failed to process' } : item
        ));
      }
    }

    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              ExamData AI
            </h1>
          </div>
          <div className="text-sm text-slate-500">
            Powered by Gemini 2.5 Flash
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Intro / Upload Section */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-slate-900">지필고사 분석 자료 자동 정리</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              PDF 파일을 업로드하면 AI가 교과목, 평균, 점수대별 인원을 자동으로 추출하여 
              하나의 통합 표로 만들어줍니다. (분석자료 및 총괄표 지원)
            </p>
          </div>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group relative border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-indigo-500 hover:bg-indigo-50/50 transition-all cursor-pointer bg-white"
          >
            <input 
              type="file" 
              multiple 
              accept=".pdf" 
              ref={fileInputRef}
              className="hidden" 
              onChange={handleFileSelect}
            />
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">PDF 파일 업로드 (다중 선택 가능)</p>
                <p className="text-slate-500 text-sm mt-1">클릭하여 파일을 선택하거나 이곳으로 드래그하세요.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Processing Status */}
        {processingQueue.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">처리 현황</h3>
            <div className="space-y-3">
              {processingQueue.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 truncate max-w-xs md:max-w-md">
                      {item.fileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'pending' && <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">대기중</span>}
                    {item.status === 'processing' && (
                      <span className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                        <Loader2 className="w-3 h-3 animate-spin" /> 처리중
                      </span>
                    )}
                    {item.status === 'completed' && (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        <CheckCircle2 className="w-3 h-3" /> 완료
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded" title={item.message}>
                        <AlertCircle className="w-3 h-3" /> 실패
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Results Table */}
        <section>
          <DataTable data={examData} />
        </section>

      </main>
    </div>
  );
};

export default App;