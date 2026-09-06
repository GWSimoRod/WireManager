using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using WireManager.Core.Interfaces;

namespace WireManager.API.Attributes
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class RequireSetupAttribute : Attribute, IAsyncActionFilter
    {

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // Recuperiamo il servizio di setup dal Service Provider della richiesta HTTP
            var setupService = context.HttpContext.RequestServices.GetRequiredService<ISetupServices>();

            bool isSetupCompleted = await setupService.IsSystemConfiguredAsync();

            if (!isSetupCompleted)
            {
                // Se il setup non è pronto, blocchiamo la chiamata restitundo un 403 Forbidden (o 400 Bad Request)
                context.Result = new ObjectResult(new
                {
                    error = "SetupRequired",
                    message = "È necessario completare il setup del sistema prima di accedere a questa risorsa."
                })
                {
                    StatusCode = StatusCodes.Status403Forbidden
                };

                return; // Non chiamiamo next(), quindi l'azione del Controller NON viene eseguita
            }

            // Se il setup è completato, lasciamo proseguire la richiesta al Controller
            await next();
        }
    }
}
