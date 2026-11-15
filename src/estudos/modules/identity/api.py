"""Interface pública do módulo identity. Única coisa importável por outros módulos (R-03).

Outros módulos referenciam o usuário por `settings.AUTH_USER_MODEL` em `ForeignKey` (R-04),
sem importar o model. Funções de caso de uso (ex.: exclusão de conta, R-52) entram aqui
conforme forem criadas em `services/`.
"""

__all__: list[str] = []
