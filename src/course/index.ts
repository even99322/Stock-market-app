// 短線交易入門課程：章節目錄
import { PART1 } from './part1';
import { PART2 } from './part2';
import { PART3 } from './part3';
import type { Chapter, Lesson } from './types';

export const COURSE: Chapter[] = [...PART1, ...PART2, ...PART3];
export const LESSONS: Lesson[] = COURSE.flatMap((c) => c.lessons);
export const lessonIndex = (id: string) => LESSONS.findIndex((l) => l.id === id);
