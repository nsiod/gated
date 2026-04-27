use gated_common::version::gated_version;
use gated_protocol_http::api;
use poem_openapi::OpenApiService;
use regex::Regex;

#[allow(
    clippy::unwrap_used,
    reason = "dev-only bin: static regex literal is known-valid"
)]
pub fn main() {
    let api_service =
        OpenApiService::new(api::get(), "Gated HTTP proxy", gated_version()).server("/api");

    let spec = api_service.spec();
    let re = Regex::new(r"PaginatedResponse<(?P<name>\w+)>").unwrap();
    let spec = re.replace_all(&spec, "Paginated$name");

    println!("{spec}");
}
