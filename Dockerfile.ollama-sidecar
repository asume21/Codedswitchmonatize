FROM ollama/ollama:latest

COPY ollama-entrypoint.sh /ollama-entrypoint.sh
RUN chmod +x /ollama-entrypoint.sh

EXPOSE 11434

ENTRYPOINT ["/ollama-entrypoint.sh"]
