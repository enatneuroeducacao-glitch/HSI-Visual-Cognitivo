export type UserRole = 'ADMIN' | 'ANALYST' | 'PARTICIPANT';

export function hasRole(role: UserRole | undefined, allowed: readonly UserRole[]): boolean {
  return role !== undefined && allowed.includes(role);
}

export function validateAssessmentMode(
  mode: string,
  answerCount: number,
  axisIds: readonly string[],
  totalQuestions: number,
): string | null {
  if (mode === 'Avaliação completa') {
    return answerCount === totalQuestions
      ? null
      : 'A avaliação completa deve conter os 30 exercícios.';
  }

  if (mode === 'Eixo individual') {
    return answerCount === 5 && new Set(axisIds).size === 1
      ? null
      : 'A avaliação individual deve conter os cinco exercícios de um único eixo.';
  }

  return 'Modalidade de avaliação inválida.';
}
