import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import { ObservabilityService } from "./metrics.service";

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly observabilityService: ObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<any>();
    const res = httpContext.getResponse<any>();

    if (!req || !res) {
      return next.handle();
    }

    const method: string = req.method || "UNKNOWN";
    const rawPath: string =
      (req.route && req.route.path) || req.path || req.url || "unknown";

    return next.handle().pipe(
      finalize(() => {
        const statusCode: number = res.statusCode ?? 0;

        this.observabilityService.incrementHttpRequest(
          method,
          rawPath,
          statusCode,
        );
      }),
    );
  }
}
