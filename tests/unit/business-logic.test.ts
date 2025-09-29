import { describe, expect, test } from 'bun:test';

// Mock business logic functions that should exist
const calculateProgress = (completed: number, total: number): number => {
   if (total === 0) return 0;
   return Math.min(Math.round((completed / total) * 100), 100);
};

const calculateGradeAverage = (grades: number[]): number => {
   if (grades.length === 0) return 0;
   const sum = grades.reduce((a, b) => a + b, 0);
   return Math.round(sum / grades.length);
};

const isDeadlinePassed = (deadline: Date): boolean => {
   return new Date() > new Date(deadline);
};

const getSubmissionStatus = (
   isSubmitted: boolean,
   isGraded: boolean,
   deadline: Date
): 'belum_dikerjakan' | 'dikerjakan' | 'selesai' | 'terlambat' => {
   if (isGraded) return 'selesai';
   if (isSubmitted) return 'dikerjakan';
   if (isDeadlinePassed(deadline)) return 'terlambat';
   return 'belum_dikerjakan';
};

const validateGrade = (grade: number): { valid: boolean; error?: string } => {
   if (grade < 0) return { valid: false, error: 'Nilai tidak boleh kurang dari 0' };
   if (grade > 100) return { valid: false, error: 'Nilai tidak boleh lebih dari 100' };
   if (!Number.isInteger(grade)) return { valid: false, error: 'Nilai harus berupa bilangan bulat' };
   return { valid: true };
};

describe('Business Logic Unit Tests', () => {
   describe('Progress Calculation', () => {
      test('should calculate progress correctly', () => {
         expect(calculateProgress(5, 10)).toBe(50);
         expect(calculateProgress(3, 4)).toBe(75);
         expect(calculateProgress(10, 10)).toBe(100);
         expect(calculateProgress(0, 5)).toBe(0);
      });

      test('should handle zero total', () => {
         expect(calculateProgress(0, 0)).toBe(0);
         expect(calculateProgress(5, 0)).toBe(0);
      });

      test('should cap progress at 100%', () => {
         expect(calculateProgress(15, 10)).toBe(100);
      });
   });

   describe('Grade Average Calculation', () => {
      test('should calculate average correctly', () => {
         expect(calculateGradeAverage([80, 90, 70])).toBe(80);
         expect(calculateGradeAverage([100, 100, 100])).toBe(100);
         expect(calculateGradeAverage([75])).toBe(75);
      });

      test('should handle empty grades array', () => {
         expect(calculateGradeAverage([])).toBe(0);
      });

      test('should round to nearest integer', () => {
         expect(calculateGradeAverage([83, 87])).toBe(85); // 85.0
         expect(calculateGradeAverage([80, 85, 90])).toBe(85); // 85.0
      });
   });

   describe('Deadline Validation', () => {
      test('should detect passed deadlines', () => {
         const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
         expect(isDeadlinePassed(pastDate)).toBe(true);
      });

      test('should detect future deadlines', () => {
         const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
         expect(isDeadlinePassed(futureDate)).toBe(false);
      });
   });

   describe('Submission Status Logic', () => {
      const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);

      test('should return correct status for graded submissions', () => {
         expect(getSubmissionStatus(true, true, futureDeadline)).toBe('selesai');
         expect(getSubmissionStatus(true, true, pastDeadline)).toBe('selesai');
      });

      test('should return correct status for submitted but ungraded', () => {
         expect(getSubmissionStatus(true, false, futureDeadline)).toBe('dikerjakan');
         expect(getSubmissionStatus(true, false, pastDeadline)).toBe('dikerjakan');
      });

      test('should return correct status for unsubmitted assignments', () => {
         expect(getSubmissionStatus(false, false, futureDeadline)).toBe('belum_dikerjakan');
         expect(getSubmissionStatus(false, false, pastDeadline)).toBe('terlambat');
      });
   });

   describe('Grade Validation', () => {
      test('should accept valid grades', () => {
         const validGrades = [0, 50, 100, 85, 92];
         validGrades.forEach(grade => {
            const result = validateGrade(grade);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
         });
      });

      test('should reject negative grades', () => {
         const result = validateGrade(-5);
         expect(result.valid).toBe(false);
         expect(result.error).toContain('tidak boleh kurang dari 0');
      });

      test('should reject grades over 100', () => {
         const result = validateGrade(105);
         expect(result.valid).toBe(false);
         expect(result.error).toContain('tidak boleh lebih dari 100');
      });

      test('should reject non-integer grades', () => {
         const result = validateGrade(85.5);
         expect(result.valid).toBe(false);
         expect(result.error).toContain('bilangan bulat');
      });
   });
});