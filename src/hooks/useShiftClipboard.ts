import { useState } from 'react';
import { CopiedShift } from '../types';

export const useShiftClipboard = () => {
  const [copiedShift, setCopiedShift] = useState<CopiedShift | null>(null);
  const [sourceCell, setSourceCell] = useState<{ employeeId: string; date: string } | null>(null);

  const copyShift = (shift: CopiedShift, employeeId: string, date: Date) => {
    setCopiedShift(shift);
    setSourceCell({ employeeId, date: date.toISOString() });
  };

  const pasteShift = (): CopiedShift | null => {
    return copiedShift;
  };

  const clearClipboard = () => {
    setCopiedShift(null);
    setSourceCell(null);
  };

  const isSourceCell = (employeeId: string, date: Date): boolean => {
    return sourceCell?.employeeId === employeeId && 
           sourceCell?.date === date.toISOString();
  };

  return {
    copiedShift,
    copyShift,
    pasteShift,
    clearClipboard,
    isSourceCell,
    hasClipboard: !!copiedShift
  };
};